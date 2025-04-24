import { Type } from "@sinclair/typebox";
import { ComputeModule } from "@palantir/compute-module";

const computeModule = new ComputeModule({
  logger: console,
  sources: {},
  definitions: {
    eval: {
      input: Type.String(),
      output: Type.Object({}),
    },
  },
});

computeModule.register("eval", async (input) => {
  const result = eval(input);
  return result;
});
