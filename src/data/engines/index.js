/** Aggregates every built-in engine module into one ordered list. */

import debug from './debug.js';
import content from './content.js';
import strategy from './strategy.js';
import productivity from './productivity.js';
import code from './code.js';
import research from './research.js';
import communication from './communication.js';
import learning from './learning.js';
import data from './data.js';
import business from './business.js';

export const BUILTIN_ENGINES = [
  ...debug,
  ...content,
  ...strategy,
  ...productivity,
  ...code,
  ...research,
  ...communication,
  ...learning,
  ...data,
  ...business,
];

export default BUILTIN_ENGINES;
