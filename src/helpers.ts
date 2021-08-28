/* eslint-disable ts-exports/unused-exports */

export const clump = <T>(arr: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

export const api = async <T>(
  endPoint: string,
  token: string,
) => {
  const url = `https://api.spotify.com/v1/${endPoint}`;
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
  });
  return (await response.json()) as T;
};

export const apiBody = async (
  endPoint: string,
  token: string,
  body: Record<string, unknown>,
  method?: "POST" | "DELETE",
) => {
  const url = `https://api.spotify.com/v1/${endPoint}`;
  const response = await fetch(url, {
    method: method ?? "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return await response.json();
};
