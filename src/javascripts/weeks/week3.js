// Interactive figures of Week 3.
import { mountAll } from '../viz/lib';
import bnCar from '../viz/bn';
import infogain from '../viz/infogain';
import knn from '../viz/knn';
import logreg from '../viz/logreg';

mountAll({ 'bn-car': bnCar, logreg, knn, infogain });
