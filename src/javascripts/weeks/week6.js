// Interactive figures of Week 6.
import { definePageScript } from '../page';
import { mountAll } from '../viz/lib';
import boids from '../viz/boids';
import drift from '../viz/drift';
import qlearning from '../viz/qlearning';

// Set up now, and again whenever the reader comes back to Week 6 (router.js).
definePageScript('week6', () => mountAll({ qlearning, boids, drift }));
