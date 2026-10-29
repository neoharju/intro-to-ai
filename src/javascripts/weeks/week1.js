// Interactive figures of Week 1.
import { mountAll } from '../viz/lib';
import alphabeta from '../viz/alphabeta';
import river from '../viz/river';
import search from '../viz/search';

mountAll({ river, search, alphabeta });
