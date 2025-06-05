// Polyfill for self in Node.js environment
if (typeof self === 'undefined' && typeof global !== 'undefined') {
  global.self = global;
}