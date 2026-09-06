/** Small insertion-ordered cache. Rendering a diagram is expensive; keeping
 *  the last few dozen SVGs around is not. */
export class Lru<K, V> {
  #map = new Map<K, V>()
  constructor(private readonly limit = 48) {}

  get(key: K): V | undefined {
    const value = this.#map.get(key)
    if (value === undefined) return undefined
    this.#map.delete(key)
    this.#map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.#map.has(key)) this.#map.delete(key)
    this.#map.set(key, value)
    if (this.#map.size > this.limit) {
      this.#map.delete(this.#map.keys().next().value as K)
    }
  }

  clear(): void { this.#map.clear() }
}
