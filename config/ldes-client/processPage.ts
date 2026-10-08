import { storeError, storeMembers, storeObservation } from "./util";

export async function processPage() {
  try {
    await storeMembers();
  } catch (error: any) {
    const observation = await storeObservation();
    error.dctType = "http://data.lblod.info/error-types/store-members-failure";
    await storeError(observation, error).catch((e) => {
      console.log(`failed to store error ${error}: ${e}`);
    });
  }
}
