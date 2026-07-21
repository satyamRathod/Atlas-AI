import { Vector } from './vector.js';

const dog = Vector.from([1, 2]);
console.log(dog.toString());
console.log('Dimension:', dog.dimension());
console.log(dog.toArray());
