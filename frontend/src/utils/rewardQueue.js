export function createRewardQueue(onPendingChange = () => {}) {
  const pending = new Map();
  let tail = Promise.resolve();
  return {
    enqueue(key, action) {
      if (pending.has(key)) return pending.get(key);
      const result = tail.then(action).finally(() => {
        pending.delete(key);
        onPendingChange([...pending.keys()]);
      });
      pending.set(key, result);
      onPendingChange([...pending.keys()]);
      tail = result.catch(() => {});
      return result;
    },
  };
}
