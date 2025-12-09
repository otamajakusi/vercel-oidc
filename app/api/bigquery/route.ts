import { BigQuery } from "@google-cloud/bigquery";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { ExternalAccountClient } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/functions/oidc";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCP_PROJECT_NUMBER = process.env.GCP_PROJECT_NUMBER;
const GCP_WORKLOAD_IDENTITY_POOL_ID = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
const GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID =
  process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
const GCP_SERVICE_ACCOUNT_EMAIL = process.env.GCP_SERVICE_ACCOUNT_EMAIL;

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SPREADSHEET_RANGE = process.env.SPREADSHEET_RANGE;

async function getAuthClient(external: boolean) {
  if (external) {
    // Initialize the External Account Client
    const authClient = ExternalAccountClient.fromJSON({
      type: "external_account",
      audience: `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
      subject_token_supplier: {
        // Use the Vercel OIDC token as the subject token
        getSubjectToken: getVercelOidcToken,
      },
      scopes: ["https://www.googleapis.com/auth/bigquery"],
    });
    return authClient;
  } else {
    const authClient = await google.auth.getClient({
      scopes: ["https://www.googleapis.com/auth/bigquery"],
    });
    return authClient;
  }
}

export async function GET(req: NextRequest) {
  try {
    const authClient = await getAuthClient(true);

    if (authClient === null) {
      throw new Error("Failed to initialize the External Account Client");
    }

    const bigquery = new BigQuery({
      GCP_PROJECT_ID,
      authClient,
    });

    const query = `SELECT * FROM `vercel-oicd.test.book` LIMIT 1`;
    const [job] = await bigquery.createQueryJob({
      query,
      params,
      types: { office_code: "INT64" },
    });
    const [rows] = await job.getQueryResults();
    console.log("Query result:", rows);

    return NextResponse.json({
      data: rows,
    });
  } catch (error: any) {
    console.error("BigQuery API error:", error);
    return NextResponse.json(
      { error: error?.message || "Unknown error" },
      { status: 500 },
    );
  }
}
