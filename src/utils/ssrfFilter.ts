import dns from "node:dns";
import { promisify } from "node:util";

const lookupAsync = promisify(dns.lookup);

export const isPrivateIp = (ip: string): boolean => {
	const ipv4MappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
	const targetIp = ipv4MappedMatch ? ipv4MappedMatch[1] : ip;

	if (/^(127\.|10\.|169\.254\.)/.test(targetIp)) {
		return true;
	}
	if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(targetIp)) {
		return true;
	}
	if (/^192\.168\./.test(targetIp)) {
		return true;
	}

	const ipLower = ip.toLowerCase();
	if (ipLower === "::1" || ipLower === "0:0:0:0:0:0:0:1") {
		return true;
	}
	if (/^(fe80:|fc00:|fd00:)/i.test(ipLower)) {
		return true;
	}

	return false;
};

export const isSafeUrl = async (urlStr: string): Promise<boolean> => {
	try {
		const parsedUrl = new URL(urlStr);
		if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
			return false;
		}

		const hostname = parsedUrl.hostname;

		if (isPrivateIp(hostname)) {
			return false;
		}

		const lowerHost = hostname.toLowerCase();
		if (lowerHost === "localhost" || lowerHost.endsWith(".local") || lowerHost.endsWith(".internal")) {
			return false;
		}

		const lookup = await lookupAsync(hostname);
		if (isPrivateIp(lookup.address)) {
			return false;
		}

		return true;
	} catch {
		return false;
	}
};
