# QA Avatar Command

An AI-assisted QA workspace for analyzing requirements, identifying gaps, and creating traceable test cases. Assign work to QA avatars, record test results, track defects, manage retesting and regression, and generate reports—with human review and approval throughout.

Runs on your own computer: no ChatGPT, no Cloudflare, no sign-in. Same features as the hosted
version (QA lifecycle, manual execution, defect register, requirement analysis, final report),
plus a **direct connection to your Autonomous QA Execution Agent** so you do not need the bridge script or file handoff.

Your data is stored in the `data/` folder next to the app. AI Review sends document text to OpenAI when enabled. Codex preparation sends the selected case definitions and inspected page snapshots to your Codex account.

## 1. Install (once)
You need **Node.js 22.13 or newer** (LTS from https://nodejs.org). Check with `node -v`.

Clone this repository, or download and extract its ZIP. Open a terminal in the project folder, then:

    git clone https://github.com/Kazihamid/qa-avatar-command.git
    cd qa-avatar-command

Install dependencies and build:

    npm run setup

## 2. Start (every time)

    npm start

Open **http://127.0.0.1:4177**. Keep the terminal open while you work. Stop with Ctrl+C.

## 3. Run mapped scenarios on your agent (Execution tab)
1. Start your agent project (Docker) as usual. Its control plane should answer at http://localhost:8080.
2. In the app open your project -> **Execution** -> "Run with your local agent".
3. Click **Check agent connection**. It must say Connected.
   (Different address or login? Copy `.env.example` to `.env`, edit it, restart.)
4. Click **Load scenarios from agent**, choose the application, and for each QA case choose the recorded scenario that really tests it, then **Save mapping** (up to 25 cases per run).
5. Click **Run mapped cases on local agent**. Review the list of target systems, tick the approval box, then click **Run N scenario(s) now**.
6. When it finishes the results are checked and imported automatically:
   - Pass: the agent reported PASSED, exit 0, at least one pytest "passed", and nothing skipped or errored.
   - Fail: FAILED with an explicit failure count. A defect draft is created for lead review.
   - Needs clarification: exit 0 but success cannot be established (for example skipped tests).
   - Blocked: setup, timeout or runtime errors. No defect draft.
7. Raw logs for each case are saved in `data/agent-evidence/<run id>/`. They may contain application data; review before sharing.

Safety rules built in:
- Only a local control-plane address is accepted, and redirects are refused.
- Only the run request saved in your workspace can be executed, and only after you tick the approval box.
- A scenario that changed since you mapped it stops the run before anything starts.
- Execution requests are never retried automatically (a timeout might mean the test already ran). One run at a time.
- Tests can change data in the target systems. Use an approved test environment.
- Credentials stay in the agent's own configuration. This app never stores them.

The file-handoff route from the hosted version still works under "Advanced" in the same panel.

## QA lifecycle and manual execution
Work through the stages in the **Lifecycle** tab (Assigned -> Analyzing -> Preparing Tests -> Executing -> Investigating -> Retesting -> Regression -> Completed).
Each stage has a checklist; you cannot skip ahead, and going back resets later approvals.
In Preparing Tests, enter the target environment and approve the suite. Build / WAR version is optional for manual testing.
Clearing requirement analysis and deleting all cases returns the project to Analyzing. Older empty Preparing Tests records are repaired when the workspace loads. Record results by hand in **Execution -> Manual execution** with an evidence reference.

## Requirements and AI Review
Attach a CR/SRS (PDF, DOCX, TXT, MD) on the **Requirements** tab and use **Analyze Requirements** (works offline, no key).
Analysis shows requirement gaps and an editable requirement checklist; it creates no test cases.
Step 1 lists source-referenced gaps and clarification questions. Step 2 provides an editable requirement checklist.
Items marked N/A (including numbered Exception: N/A sections) and document administration notes are excluded.
Image-only mockups need visual review; the offline analysis does not compare their pixels with business rules.
Edit statements to resolve gaps, uncheck or remove unwanted items, and use **Save Review** to keep your work.
When the list is ready, choose **Finalize Requirements**. This saves the reviewed list without generating tests.
Choose **Write Test Cases** separately to generate traceable cases from only the selected finalized requirements.
Review their titles, preconditions, test data, steps and expected results, then choose **Add N Test Cases**.
Missing setup and data are marked for clarification rather than invented. Use **Edit Requirements** to reopen the list; generation is disabled until it is finalized again.
AI Review is optional and needs an OpenAI **API** account with credit (ChatGPT Plus does not pay for API calls). Put the key in `.env`.

## Safety notes
- The app only answers on 127.0.0.1 (this computer) and rejects requests from other websites or addresses.
- There is no password because only this computer can reach it. Do not expose the port to a network.
- Back up the `data/` folder to keep your work. Delete it to start fresh.
- Data from the hosted ChatGPT version is not copied over automatically.

## For developers
`npm run typecheck`, `npm test` (lifecycle rules), `npm run build`. The ported source matches hosted source v5 (commit 8636eacad57f); only sign-in, storage and the agent connection differ.

## Export test cases to Excel
On the Test Cases tab, choose **Export To Excel**. Selected cases are exported, including selected cases hidden by filters. If none are selected, the export includes all currently displayed cases. The .xlsx workbook contains requirement references, scenario titles, preconditions, data, steps, expected and actual results, priorities, statuses and evidence.

## Cloudflare hosting
See [CLOUDFLARE.md](CLOUDFLARE.md) for the private deployment, free-tier storage limits and deployment commands. Local and cloud workspaces are separate.

## Codex execution companion

The Execution tab includes **Execute With Codex**. Select up to 10 reviewed cases and choose **Prepare With Codex**. The companion uses Codex to inspect your test environment and prepare browser actions. Review those actions and the listed test data, then choose **Approve & Run** for the batch. Results and a Markdown test report appear in the app automatically. Cases missing setup, test data or observable checks explain what needs review.

The companion runs on your computer and connects to either your Cloudflare workspace or your local app. Keep your PC and its companion terminal running during preparation and execution. Preparation uses your current Codex account and its usage allowance.

Set up once in the repository folder:

    npm install
    npm run codex:login
    npm run codex:setup

Copy the Codex companion settings from .env.example into your local .env. Set QA_AVATAR_URL to your app address. For Cloudflare, set QA_AVATAR_USER and QA_AVATAR_PASSWORD to your app login. Enter these only in your local file. Start the companion:

    npm run codex:worker

To test an application that requires sign-in, save a browser session locally first:

    npx playwright codegen --save-storage=data/codex-auth.json https://your-test-environment.example

Sign in in that browser, close it, set QA_CODEX_STORAGE_STATE=data/codex-auth.json in .env, and restart the companion. Authentication state, screenshots and traces stay in the ignored data/ folder. The cloud report contains local evidence references.

Codex receives the selected case definitions and page snapshots to prepare actions. The companion starts a browser inspection MCP server for that Codex invocation. Its inspection tool uses GET requests and exposes no form submission tools. Execution uses a fixed set of Playwright actions and observable assertions after batch approval. It can also reuse scenarios already mapped to the local agent.

Each run is recorded in data/codex-runs/<run-id>/. Open report.md for the report, results.json for the complete result file and each case folder for screenshots, errors and trace.zip. Inspect a trace using npx playwright show-trace followed by its file path.

Completed batches update case outcomes and create defect drafts for failed checks. Changing the environment, build, assignment or selected case definitions invalidates a pending batch. An interrupted execution is kept for inspection and requires a new batch for another attempt. Cancel Batch stops further browser cases when the companion checks the request again. An action or mapped agent run already in progress may finish.

After pulling future changes, run npm install and npm run codex:setup again to rebuild the companion.

When every case needs attention, the execution panel shows the preparation reasons and offers Prepare This Batch Again. Approve & Run becomes available once at least one case has an executable plan. The companion verifies browser inspection before asking Codex to prepare a plan. Restart the companion after rebuilding it to apply updates.

For assessment screens that use a URL fragment, enter the complete address in Test Page URL before preparing the batch. That address is included in the batch approval and used for inspection and execution. If HRMS reports that another device signed in, refresh the saved Playwright session and use that account in one browser during the run.
