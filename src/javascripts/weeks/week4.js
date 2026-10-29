// Interactive figures of Week 4.
import { mountAll } from '../viz/lib';
import activations from '../viz/activations';
import mlp from '../viz/mlp';
import perceptron from '../viz/perceptron';

mountAll({ perceptron, activations, mlp });
