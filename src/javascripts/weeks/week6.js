// Interactive figures of Week 6.
import { mountAll } from '../viz/lib';
import boids from '../viz/boids';
import drift from '../viz/drift';
import qlearning from '../viz/qlearning';

mountAll({ qlearning, boids, drift });
