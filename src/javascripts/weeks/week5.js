// Interactive figures of Week 5.
import { definePageScript } from '../page';
import { mountAll } from '../viz/lib';
import attention from '../viz/attention';
import posenc from '../viz/posenc';
import sampling from '../viz/sampling';

// Set up now, and again whenever the reader comes back to Week 5 (router.js).
definePageScript('week5', () => mountAll({ attention, posenc, sampling }));
