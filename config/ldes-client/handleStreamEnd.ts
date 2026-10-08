import { environment } from "../environment";

export async function handleStreamEnd() {
  const CURRENT_STREAM_NAME = environment.getCurrentStreamConfig().name;
  console.log(`stream ${CURRENT_STREAM_NAME} has ended`);
}
