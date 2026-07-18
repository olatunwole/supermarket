import fs from 'fs';

const printV1Jsx = () => {
  const content = fs.readFileSync('v1_jsx.txt', 'utf16le');
  // Write it back as UTF-8
  fs.writeFileSync('v1_jsx_utf8.txt', content, 'utf-8');
  console.log('Saved to v1_jsx_utf8.txt in UTF-8!');
};

printV1Jsx();
