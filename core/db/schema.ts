// Sub-module Drizzle schemas are imported here as they are implemented.
// Each module registers its tables in its own schema file and re-exports through this barrel.

export * from './schema/workspace';
export * from './schema/data-source';
export * from './schema/chat';
export * from '../../modules/ainderstanding/govern/db/schema';
export * from '../../modules/ainderstanding/explore/db/schema';
export * from '../../modules/ainderstanding/model/db/schema';
