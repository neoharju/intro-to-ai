// Interactive figures of Week 1.
import { definePageScript } from '../page';
import { mountAll } from '../viz/lib';
import alphabeta from '../viz/alphabeta';
import river from '../viz/river';
import search from '../viz/search';

// Set up now, and again whenever the reader comes back to Week 1 (router.js).
definePageScript('week1', () => mountAll({ river, search, alphabeta }));
