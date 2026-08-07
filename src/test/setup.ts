import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import "@testing-library/jest-dom/vitest";

declare global {
  namespace Vi {
    type JestAssertionType = TestingLibraryMatchers<
      ReturnType<typeof expect>,
      HTMLElement
    >;
  }
}
