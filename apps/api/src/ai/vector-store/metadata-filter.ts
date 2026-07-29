export interface MetadataFilter {
  /**
   * Payload field name.
   *
   * Example:
   *  - source
   *  - category
   *  - tenantId
   */
  key: string;

  /**
   * Exact value match.
   */
  value: string | number | boolean;
}
