import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import axios from "axios";

interface ApiKeyDescriptor {
  value: string;
  status: "active" | "cooldown";
  cooldownUntil: number;
}

export class GeminiKeyRotator {
  private static instance: GeminiKeyRotator;
  private keys: ApiKeyDescriptor[] = [];
  private currentPointer: number = 0;
  private cooldownDurationMs = 60000;

  private constructor() {
    const rawKeys = process.env.GOOGLE_API_KEYS || process.env.GEMINI_API_KEYS || "";
    const fallbackKey = process.env.GOOGLE_API_KEY || "";
    
    const parsedKeys = rawKeys
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);

    if (parsedKeys.length === 0 && fallbackKey) {
      parsedKeys.push(fallbackKey);
    }

    this.keys = parsedKeys.map(value => ({
      value,
      status: "active",
      cooldownUntil: 0
    }));

    if (this.keys.length === 0) {
      throw new Error("No Gemini or Google API keys configured in environment variables");
    }
  }

  public static getInstance(): GeminiKeyRotator {
    if (!GeminiKeyRotator.instance) {
      GeminiKeyRotator.instance = new GeminiKeyRotator();
    }
    return GeminiKeyRotator.instance;
  }

  public getKeyCount(): number {
    return this.keys.length;
  }

  public getActiveKey(): { key: string; index: number } {
    this.cleanupCooldowns();
    const startingPointer = this.currentPointer;

    while (true) {
      const currentKey = this.keys[this.currentPointer];

      if (currentKey.status === "active") {
        return {
          key: currentKey.value,
          index: this.currentPointer
        };
      }

      this.currentPointer = (this.currentPointer + 1) % this.keys.length;

      if (this.currentPointer === startingPointer) {
        throw new Error("ALL_KEYS_EXHAUSTED");
      }
    }
  }

  public markAsCooldown(keyValue: string): void {
    const key = this.keys.find(k => k.value === keyValue);
    if (key) {
      key.status = "cooldown";
      key.cooldownUntil = Date.now() + this.cooldownDurationMs;
      console.warn(`[GeminiKeyRotator] Key marked as COOLDOWN: index ${this.keys.indexOf(key)}`);
    }
    this.currentPointer = (this.currentPointer + 1) % this.keys.length;
  }

  private cleanupCooldowns(): void {
    const now = Date.now();
    for (const key of this.keys) {
      if (key.status === "cooldown" && now > key.cooldownUntil) {
        key.status = "active";
        key.cooldownUntil = 0;
        console.log(`[GeminiKeyRotator] Key restored to ACTIVE: index ${this.keys.indexOf(key)}`);
      }
    }
  }
}

function isRateLimitError(error: any): boolean {
  const message = error?.message || "";
  const status = error?.status || 0;
  return (
    status === 429 ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("429") ||
    message.includes("Quota exceeded")
  );
}

export function createRotatingGeminiModel(config: any): ChatGoogleGenerativeAI {
  const rotator = GeminiKeyRotator.getInstance();

  const createUnderlyingModel = (apiKey: string) => {
    return new ChatGoogleGenerativeAI({
      ...config,
      apiKey
    });
  };

  const { key: initialKey } = rotator.getActiveKey();
  let currentModel = createUnderlyingModel(initialKey);

  const handler: ProxyHandler<ChatGoogleGenerativeAI> = {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(currentModel, prop, receiver);

      if (
        typeof originalValue === "function" &&
        (prop === "_generate" || prop === "_streamResponseChunks" || prop === "_call")
      ) {
        return async function (this: any, ...args: any[]) {
          let attempts = 0;
          const maxAttempts = rotator.getKeyCount();

          while (attempts < maxAttempts) {
            const { key } = rotator.getActiveKey();
            try {
              return await originalValue.apply(currentModel, args);
            } catch (error: any) {
              if (isRateLimitError(error)) {
                rotator.markAsCooldown(key);
                const { key: newKey } = rotator.getActiveKey();
                currentModel = createUnderlyingModel(newKey);
                attempts++;
              } else {
                throw error;
              }
            }
          }
          throw new Error("ALL_GEMINI_KEYS_EXHAUSTED");
        };
      }

      return typeof originalValue === "function"
        ? originalValue.bind(currentModel)
        : originalValue;
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(currentModel);
    }
  };

  return new Proxy(currentModel, handler);
}

export async function generateEmbeddingsWithFailover(texts: string[]): Promise<number[][]> {
  const rotator = GeminiKeyRotator.getInstance();
  const models = ["gemini-embedding-001", "gemini-embedding-2"];

  for (const model of models) {
    let attempts = 0;
    const maxAttempts = rotator.getKeyCount();

    while (attempts < maxAttempts) {
      const { key } = rotator.getActiveKey();
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${key}`,
          {
            requests: texts.map(text => ({
              model: `models/${model}`,
              content: { parts: [{ text }] },
              outputDimensionality: 768
            }))
          },
          {
            headers: {
              "Content-Type": "application/json"
            }
          }
        );

        if (response.data && response.data.embeddings) {
          return response.data.embeddings.map((e: any) => e.values);
        }
        
        throw new Error("Invalid response format from Gemini API");
      } catch (error: any) {
        const status = error?.response?.status || 0;
        const errMsg = error?.response?.data?.error?.message || error?.message || "";
        
        if (
          status === 429 ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("Quota exceeded") ||
          errMsg.includes("429")
        ) {
          rotator.markAsCooldown(key);
          attempts++;
        } else {
          throw error;
        }
      }
    }
  }

  throw new Error("ALL_GEMINI_EMBEDDING_KEYS_AND_MODELS_EXHAUSTED");
}
