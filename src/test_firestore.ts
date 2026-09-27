
import { testFirebaseConnection } from './lib/firebase';

async function runTest() {
  console.log("Running Firebase diagnostic test...");
  const result = await testFirebaseConnection();
  console.log("Result:", JSON.stringify(result, null, 2));
}

runTest();
