// Model registry: cell data names a model id, this maps it to a builder.
// Adding a new cell type = one data entry + one model file + one line here.
import { build as cylindrical } from './cylindrical.js';
import { build as prismatic } from './prismatic.js';
import { build as pouch } from './pouch.js';

export const MODELS = { cylindrical, prismatic, pouch };
