import fs from 'fs';
import path from 'path';

const logPath = 'C:\\Users\\fyl\\.gemini\\antigravity-ide\\brain\\6e04a09f-e230-4dc3-a222-3e183b2f09bb\\.system_generated\\logs\\transcript_full.jsonl';

const findAnyFileView = () => {
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split('\n');

  console.log('Searching all steps in transcript_full.jsonl...');
  
  lines.forEach((line) => {
    if (!line.trim()) return;
    try {
      const step = JSON.parse(line);
      
      // Check tool calls
      if (step.tool_calls) {
        step.tool_calls.forEach((tool: any) => {
          const args = typeof tool.args === 'string' ? JSON.parse(tool.args) : tool.args;
          const target = args.TargetFile || args.Target || args.AbsolutePath || '';
          if (target.includes('Inventory.tsx') || target.includes('POS.tsx') || target.includes('PurchaseOrders.tsx')) {
            console.log(`Step ${step.step_index} | Tool: ${tool.name} | Target: ${target}`);
            if (tool.name === 'write_to_file') {
              console.log(`  write_to_file code content length: ${args.CodeContent?.length}`);
            }
          }
        });
      }

      // Check outputs of view_file
      if (step.type === 'VIEW_FILE' && step.status === 'DONE') {
        const toolCall = step.tool_calls?.[0] || {};
        const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args;
        const target = args?.AbsolutePath || '';
        if (target.includes('Inventory.tsx') || target.includes('POS.tsx') || target.includes('PurchaseOrders.tsx')) {
          console.log(`Step ${step.step_index} output VIEW_FILE | Target: ${target}`);
          console.log(`  Lines: ${args.StartLine}-${args.EndLine} | Content length: ${step.content?.length}`);
        }
      }
    } catch (e) {}
  });
};

findAnyFileView();
