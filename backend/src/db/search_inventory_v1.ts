import fs from 'fs';
import path from 'path';

const logPath = 'C:\\Users\\fyl\\.gemini\\antigravity-ide\\brain\\6e04a09f-e230-4dc3-a222-3e183b2f09bb\\.system_generated\\logs\\transcript_full.jsonl';

const searchInventory = () => {
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line) => {
    if (!line.trim()) return;
    try {
      const step = JSON.parse(line);
      
      // Look for any model write/edit or view of Inventory.tsx before step 384
      if (step.step_index < 384) {
        let isInv = false;
        if (step.tool_calls) {
          step.tool_calls.forEach((tool: any) => {
            const args = typeof tool.args === 'string' ? JSON.parse(tool.args) : tool.args;
            const target = args?.AbsolutePath || args?.TargetFile || '';
            if (target.includes('Inventory.tsx')) {
              isInv = true;
            }
          });
        }
        if (step.type === 'VIEW_FILE' && step.status === 'DONE') {
          const toolCall = step.tool_calls?.[0] || {};
          const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args;
          const target = args?.AbsolutePath || '';
          if (target.includes('Inventory.tsx')) {
            isInv = true;
          }
        }
        if (isInv) {
          console.log(`Step ${step.step_index} | Type: ${step.type} | Length: ${step.content?.length || 0}`);
        }
      }
    } catch (e) {}
  });
};

searchInventory();
