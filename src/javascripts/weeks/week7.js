// Interactive figures of Week 7.
import { definePageScript } from '../page';
import { mountAll } from '../viz/lib';
import aiAct from '../viz/aiact';
import collapse from '../viz/collapse';

// Set up now, and again whenever the reader comes back to Week 7 (router.js).
definePageScript('week7', () => mountAll({ 'ai-act': aiAct, collapse }));
