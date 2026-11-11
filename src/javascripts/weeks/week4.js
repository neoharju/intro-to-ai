// Interactive figures of Week 4.
import { definePageScript } from '../page';
import { mountAll } from '../viz/lib';
import activations from '../viz/activations';
import mlp from '../viz/mlp';
import perceptron from '../viz/perceptron';

// Set up now, and again whenever the reader comes back to Week 4 (router.js).
definePageScript('week4', () => mountAll({ perceptron, activations, mlp }));
