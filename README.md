# QA Avatar Command

An AI-assisted QA workspace for analyzing requirements, identifying gaps, and creating traceable test cases. Assign work to QA avatars, record test results, track defects, manage retesting and regression, and generate reports—with human review and approval throughout.

Runs on your own computer: no ChatGPT, no Cloudflare, no sign-in. Same features as the hosted
version (QA lifecycle, manual execution, defect register, requirement analysis, final report),
plus a **direct connection to your Autonomous QA Execution Agent** so you do not need the bridge script or file handoff.

Your data is stored in the `data/` folder next to the app. Nothing leaves your computer unless you turn on AI Review.

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
Each stage has a checklist; you cannot skip ahead, and going back resets later approvals. Record results by hand in **Execution -> Manual execution** with an evidence reference.

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
