import { templateService } from "../services/templateService";

async function test() {
	console.log("Testing template discovery...");
	try {
		const templates = await templateService.listTemplates();
		console.log("Templates found:", JSON.stringify(templates, null, 2));
		
		if (templates.length > 0) {
			const content = await templateService.getTemplateContent(templates[0].id);
			console.log(`Content of first template (${templates[0].id}) length:`, content.length);
		} else {
			console.log("No templates found!");
		}
	} catch (err) {
		console.error("Test failed:", err);
	}
}

test();
