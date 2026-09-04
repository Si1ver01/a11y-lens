export default defineContentScript({
  registration: 'runtime',
  main() {
    // The runtime listener is attached in the audit lifecycle task.
  },
});
