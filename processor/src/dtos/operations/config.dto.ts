import { Static, Type } from '@sinclair/typebox';

export const ConfigResponseSchema = Type.Object({
  clientId: Type.String(),
  environment: Type.String(),
});

export type ConfigResponseSchemaDTO = Static<typeof ConfigResponseSchema>;
