
import * as core from "@actions/core";
import { IncomingWebhook } from '@slack/webhook';
import { Octokit } from "octokit";

const slackWebhook = core.getInput('slack-webhook');
const githubToken = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repositoryName = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;

const regex = /[^\/]+\/([A-Za-z0-9-]+)/;
const match = regex.exec(repositoryName);
const repository = match ? match[1] : null;

async function main() {
    const octokit = new Octokit({ auth: githubToken });
    const webhook = new IncomingWebhook(slackWebhook);

    const responseJobs = await octokit.rest.actions.listJobsForWorkflowRun({
        owner: owner,
        repo: repository,
        run_id: runId,
    });

    const responseRun = await octokit.rest.actions.getWorkflowRun({
        owner: owner,
        repo: repository,
        run_id: runId,
    });

    const jobs = responseJobs.data;

    (async () => {
        await webhook.send({
            "username": `[Github] ${responseRun.data.triggering_actor.login}`,
            "icon_url": `https://github.com/${responseRun.data.triggering_actor.login}.png?size=32`,
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Um novo build foi realizado em *${repository}*:`
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": `*Ref*\n${responseRun.data.head_branch}`
                        },
                        {
                            "type": "mrkdwn",
                            "text": `*Event*\n${responseRun.data.event}`
                        }
                    ]
                },
                {
                    "type": "divider"
                }
            ].concat(jobs.jobs.filter((job) => job.status === 'completed').map(job => {
                var icon = '';
                if (job.status === 'completed') {
                    icon = job.conclusion === 'success' ? '✅' : '❌';
                } else {
                    icon = '🔄';
                }

                return {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `*${job.name}*\n${icon} ${job.conclusion}` + (job.conclusion === 'failure' ? '\n> Failed on: ' + job.steps.find((e) => e.conclusion === "failure").name : '')
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Logs",
                            "emoji": true
                        },
                        "value": "click_me_123",
                        "url": job.html_url
                    }
                }
            }))
                .concat(
                    {
                        "type": "divider"
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "View Commit",
                                },
                                "value": "click_me_123",
                                "url": `https://github.com/${owner}/${repository}/commit/${responseRun.data.head_commit.id}`
                            },
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "View CI/CD",
                                },
                                "value": "click_me_123",
                                "url": `${responseRun.data.html_url}`
                            }
                        ]
                    })
        });
    })();
}

main();