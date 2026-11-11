// Interactive figures of Week 2.
import { definePageScript } from '../page';
import { mountAll } from '../viz/lib';
import bayes from '../viz/bayes';
import underflow from '../viz/underflow';

// Set up now, and again whenever the reader comes back to Week 2 (router.js).
definePageScript('week2', () => mountAll({ bayes, underflow }));
