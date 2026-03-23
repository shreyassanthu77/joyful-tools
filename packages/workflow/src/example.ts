import { Workflow, MemoryBackend } from "@joyful/workflow";
import { type } from "arktype";

const workflow = new Workflow({
  backend: new MemoryBackend(),
});

const sendEmail = workflow.define({
  name: "send-email",
  input: type({
    userId: "string",
    subject: "string",
    body: "string",
  }),
});

const worker = workflow.createWorker({
  concurrency: 2,
});
worker.on(sendEmail, async (ctx, { userId, subject, body }) => {
  const userEmail = await ctx.step(
    "fetch-user",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return userId;
    },
    { retry: 3 },
  );

  ctx.step(
    "send-email",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(`Sending email to ${userEmail}
Subject: ${subject}
${body}
`);
    },
    {
      retry: [1000, 3000, 10000],
    },
  );
});
worker.start();

const id = await sendEmail({
  userId: "123",
  subject: "Hello",
  body: "World",
});
console.log(id);

while (true) {
  const progress = await workflow.progress(id);
  console.log(progress);
  if (progress.status === "done") break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}
