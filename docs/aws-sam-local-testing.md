# AWS SAM Local Testing Guide

This guide explains how to configure a Node.js or TypeScript project so AWS SAM can build and run a Lambda function locally. It is based on the setup used in this project, but the same objective applies to any similar backend project.

## Objective

Use AWS SAM to test that a Lambda function can be built and invoked locally in an environment close to AWS Lambda.

The goal is not to replace unit tests such as Jest. The goal is to verify the Lambda package and handler wiring:

- The SAM template is valid.
- The Lambda source is compiled into JavaScript.
- The handler path points to a real exported function.
- The Lambda artifact runs inside the AWS Lambda runtime container.

## Important Concept

For TypeScript projects, Lambda does not run `.ts` files directly.

If your handler is:

```yaml
Handler: lambda.handler
```

then the built Lambda artifact must contain:

```text
lambda.js
```

and that file must export:

```ts
export const handler = async (event: unknown) => {
  // ...
};
```

If the build artifact only contains `lambda.ts`, the Lambda runtime will fail with an error like:

```text
Runtime.ImportModuleError: Cannot find module 'lambda'
```

## Required Tools

Install these before using SAM locally:

- Node.js
- npm
- AWS SAM CLI
- Docker Desktop

Docker must be running before you use:

```bash
sam local invoke
```

SAM uses Docker to run a local Lambda runtime container.

## Minimal Project Structure

A simple TypeScript Lambda project can look like this:

```text
my-project/
  lambda.ts
  package.json
  package-lock.json
  template.yaml
  tsconfig.json
```

The Lambda source file can be:

```ts
// lambda.ts
export const handler = async (event: unknown) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Lambda works" }),
  };
};
```

## SAM Template For TypeScript

Use `esbuild` so SAM can compile TypeScript into JavaScript during `sam build`.

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  TestFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: nodejs18.x
      Handler: lambda.handler
      CodeUri: .
      Timeout: 30
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        EntryPoints:
          - lambda.ts
        Target: es2021
        Sourcemap: true
```

### What Each Field Means

`Runtime: nodejs18.x`

The Node.js version used by the Lambda runtime container. Use a runtime supported by AWS Lambda, such as `nodejs18.x`, `nodejs20.x`, or newer if available in your SAM version.

`Handler: lambda.handler`

This means Lambda will load `lambda.js` and call the exported function named `handler`.

`CodeUri: .`

This tells SAM that the Lambda code starts at the project root.

`BuildMethod: esbuild`

This tells SAM to use esbuild to compile and bundle the TypeScript handler.

`EntryPoints`

This tells esbuild which TypeScript file is the Lambda entry file.

## Install esbuild

Install esbuild as a dev dependency:

```bash
npm install --save-dev esbuild
```

This adds it to `package.json` and `package-lock.json`.

## Recommended npm Scripts

Add scripts like these to `package.json`:

```json
{
  "scripts": {
    "sam:build": "sam build",
    "sam:invoke": "sam local invoke TestFunction"
  }
}
```

Using npm scripts is helpful because npm automatically adds this folder to the command PATH:

```text
node_modules/.bin
```

That lets SAM find the local `esbuild` executable.

Without npm scripts, `sam build` may fail with:

```text
Cannot find esbuild. esbuild must be installed on the host machine.
```

## Build And Invoke

Run these commands:

```bash
npm run sam:build
```

Expected result:

```text
Build Succeeded
```

Then invoke the function locally.

In Git Bash:

```bash
echo '{}' | npm run sam:invoke
```

In PowerShell:

```powershell
'{ }' | npm run sam:invoke
```

Expected result:

```json
{"statusCode":200,"body":"{\"message\":\"Lambda works\"}"}
```

## How To Verify The Build Artifact

After `npm run sam:build`, check the build folder:

```text
.aws-sam/build/TestFunction/
```

You should see:

```text
lambda.js
lambda.js.map
```

If you only see `lambda.ts`, the TypeScript file was copied but not compiled. In that case, check:

- `esbuild` is installed.
- `Metadata.BuildMethod` is set to `esbuild`.
- `BuildProperties.EntryPoints` points to the correct `.ts` file.
- You are running `sam build` through `npm run sam:build`.

## Relationship With Jest Tests

SAM local testing and Jest testing have different jobs.

Use Jest for application logic:

```bash
npm test
```

Use SAM for Lambda packaging and runtime verification:

```bash
npm run sam:build
echo '{}' | npm run sam:invoke
```

For a healthy project, run both:

```bash
npm test
npm run sam:build
echo '{}' | npm run sam:invoke
```

## Common Errors

### Cannot find module 'lambda'

Example:

```text
Runtime.ImportModuleError: Cannot find module 'lambda'
```

Cause:

Lambda looked for `lambda.js`, but it was not present in the build artifact.

Fix:

- Use `BuildMethod: esbuild`.
- Make sure `EntryPoints` includes `lambda.ts`.
- Make sure `Handler` is `lambda.handler`.
- Rebuild with `npm run sam:build`.

### Cannot find esbuild

Example:

```text
Cannot find esbuild. esbuild must be installed on the host machine.
```

Cause:

SAM could not find the esbuild executable.

Fix:

```bash
npm install --save-dev esbuild
npm run sam:build
```

Prefer `npm run sam:build` over direct `sam build` because npm exposes `node_modules/.bin` to the script.

### Docker is not running

Example:

```text
Running AWS SAM projects locally requires a container runtime.
Do you have Docker installed and running?
```

Cause:

`sam local invoke` needs Docker.

Fix:

Open Docker Desktop and wait until it is running, then retry:

```bash
npm run sam:invoke
```

### Handler name mismatch

If your template says:

```yaml
Handler: app.main
```

then your built artifact must contain:

```text
app.js
```

and it must export:

```ts
export const main = async () => {};
```

The pattern is:

```text
Handler: fileName.exportedFunctionName
```

## Applying This To Another Project

Use this checklist:

1. Create a Lambda entry file, for example `lambda.ts`.
2. Export a handler function from that file.
3. Add a `template.yaml` with `AWS::Serverless::Function`.
4. Set `Handler` to match the compiled JavaScript file and export name.
5. Add `BuildMethod: esbuild`.
6. Add `EntryPoints` pointing to the TypeScript entry file.
7. Install `esbuild`.
8. Add `sam:build` and `sam:invoke` npm scripts.
9. Run `npm run sam:build`.
10. Run `echo '{}' | npm run sam:invoke`.

## Current Project Commands

For this project, use:

```bash
npm test
npm run sam:build
```

PowerShell:

```powershell
'{ }' | npm run sam:invoke
```

Git Bash:

```bash
echo '{}' | npm run sam:invoke
```

