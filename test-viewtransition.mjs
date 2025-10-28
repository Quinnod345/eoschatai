import * as React from 'react';

console.log('React exports:', Object.keys(React).sort().join(', '));
console.log('ViewTransition type:', typeof React.ViewTransition);
console.log('ViewTransition value:', React.ViewTransition);

// Check if it's a Symbol
if (typeof React.ViewTransition === 'symbol') {
  console.log('It is a symbol!');
  console.log('Symbol description:', React.ViewTransition.description);
}
