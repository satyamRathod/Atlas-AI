/**
 * Vector Value Object
 *
 * Why this exists:
 * - Encapsulates vector operations used by embedding systems.
 * - Keeps vectors immutable.
 * - Serves as the mathematical foundation for semantic search.
 *
 * Used later by:
 * - Cosine Similarity
 * - Vector Search
 * - RAG Retrieval
 * - pgvector / Pinecone / Qdrant integrations
 */

export class Vector {
  private constructor(private readonly values: Float32Array) {}

  static from(values: number[]): Vector {
    if (!values.length) throw new Error('Vector cannot be empty.');
    if (!values.every(Number.isFinite)) throw new Error('Invalid vector.');
    return new Vector(Float32Array.from(values));
  }

  dimension(): number {
    return this.values.length;
  }

  dot(other: Vector): number {
    this.ensureDimension(other);
    let sum = 0;
    for (let i = 0; i < this.values.length; i++) {
      sum += this.values[i] * other.values[i];
    }
    return sum;
  }

  magnitude(): number {
    let sum = 0;
    for (const v of this.values) sum += v * v;
    return Math.sqrt(sum);
  }

  normalize(): Vector {
    const mag = this.magnitude();
    if (mag === 0) throw new Error('Cannot normalize zero vector.');
    return this.scale(1 / mag);
  }

  cosineSimilarity(other: Vector): number {
    return this.normalize().dot(other.normalize());
  }

  add(other: Vector): Vector {
    this.ensureDimension(other);
    return new Vector(Float32Array.from(this.values, (v, i) => v + other.values[i]));
  }

  subtract(other: Vector): Vector {
    this.ensureDimension(other);
    return new Vector(Float32Array.from(this.values, (v, i) => v - other.values[i]));
  }

  scale(scalar: number): Vector {
    return new Vector(Float32Array.from(this.values, (v) => v * scalar));
  }

  toArray(): number[] {
    return Array.from(this.values);
  }

  private ensureDimension(other: Vector) {
    if (this.dimension() !== other.dimension()) {
      throw new Error('Dimension mismatch.');
    }
  }
}
