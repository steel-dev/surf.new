import dotenv from "dotenv";
import cron from "node-cron";
import fetch from "node-fetch";

dotenv.config();

// Configuration
const GRAPHQL_ENDPOINT = "https://backboard.railway.app/graphql/v2";
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID;
const API_TOKEN = process.env.TEAM_TOKEN;

// GraphQL Queries
const QUERIES = {
  GET_DEPLOYMENTS: `
    query GetDeployments($projectId: String!) {
      deployments(input: { projectId: $projectId }) {
        edges {
          node {
            id
            createdAt
          }
        }
      }
    }
  `,
  REDEPLOY: `
    mutation RedeployLatest($id: String!) {
      deploymentRedeploy(id: $id, usePreviousImageTag: true) {
        id
        status
        url
      }
    }
  `,
};

// Helper function for GraphQL requests
async function graphqlRequest(query, variables = {}) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();
    console.log("GraphQL Response:", JSON.stringify(data, null, 2));

    if (data.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(data.errors[0].message, null, 2)}`);
    }

    if (!data.data) {
      throw new Error("No data in GraphQL response");
    }

    return data.data;
  } catch (error) {
    console.error("GraphQL Request Error:", error);
    throw error;
  }
}

// Get latest deployment for a project
async function getLatestDeployment(projectId) {
  const data = await graphqlRequest(QUERIES.GET_DEPLOYMENTS, { projectId });

  if (!data.deployments?.edges?.length) {
    throw new Error("No deployments found for this project");
  }

  return data.deployments.edges.reduce((latest, current) => {
    return new Date(current.node.createdAt) > new Date(latest.node.createdAt) ? current : latest;
  });
}

// Redeploy a specific deployment
async function redeployDeployment(deploymentId) {
  const data = await graphqlRequest(QUERIES.REDEPLOY, { id: deploymentId });

  if (!data.deploymentRedeploy) {
    throw new Error("Failed to redeploy deployment");
  }

  return data.deploymentRedeploy;
}

// Main function to trigger redeploy
async function triggerRedeploy() {
  try {
    if (!PROJECT_ID || !API_TOKEN) {
      throw new Error("Missing required environment variables: RAILWAY_PROJECT_ID or TEAM_TOKEN");
    }

    const latestDeployment = await getLatestDeployment(PROJECT_ID);
    const deploymentId = latestDeployment.node.id;

    console.log(`Redeploying deployment: ${deploymentId}`);
    const result = await redeployDeployment(deploymentId);
    console.log("Redeploy successful:", result);
  } catch (error) {
    console.error("Redeploy failed:", error.message);
    process.exit(1);
  }
}

// Schedule the redeploy to run every 6 hours
const CRON_SCHEDULE = "0 */6 * * *"; // At minute 0 of every 6th hour

// Log startup information
console.log("Starting Railway deployment monitor...");

// Calculate next run time (next hour divisible by 6)
const now = new Date();
const nextRun = new Date(now);
nextRun.setHours(Math.ceil(now.getHours() / 6) * 6, 0, 0, 0);
if (nextRun <= now) {
  nextRun.setHours(nextRun.getHours() + 6);
}
console.log(`Next scheduled run: ${nextRun.toLocaleString()}`);

// Create the schedule
const schedule = cron.schedule(CRON_SCHEDULE, () => {
  console.log(`\nScheduled redeploy triggered at ${new Date().toLocaleString()}`);
  triggerRedeploy();
});

// Run immediately on startup
console.log("Running initial deployment check...");
triggerRedeploy();
