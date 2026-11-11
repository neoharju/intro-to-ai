// Interactive figures of Week 3.
import { definePageScript } from '../page';
import { mountAll } from '../viz/lib';
import bnCar from '../viz/bn';
import infogain from '../viz/infogain';
import knn from '../viz/knn';
import logreg from '../viz/logreg';

// Set up now, and again whenever the reader comes back to Week 3 (router.js).
definePageScript('week3', () => mountAll({ 'bn-car': bnCar, logreg, knn, infogain }));
