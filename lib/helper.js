import {curry} from 'smart-table-operators';

export function* giveMeN (n) {
  for (let i = 0; i < n; i++) {
    yield i;
  }
}

export const doNTimes = curry((fn, count = 1) => {
  const n = count || 1;
  [...giveMeN(n)].forEach(() => fn());
}, 2);
