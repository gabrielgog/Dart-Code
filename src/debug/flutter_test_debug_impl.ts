import * as child_process from "child_process";
import * as path from "path";
import { Event, OutputEvent, TerminatedEvent } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { DartDebugSession } from "./dart_debug_impl";
import { VMEvent } from "./dart_debug_protocol";
import { FlutterTest, Test, TestDoneNotification, Group, Suite, DoneNotification } from "./flutter_test";
import { FlutterLaunchRequestArguments, formatPathForVm, isWin, uriToFilePath } from "./utils";

const tick = "✓";
const cross = "✖";

export class FlutterTestDebugSession extends DartDebugSession {
	protected args: FlutterLaunchRequestArguments;
	private flutter: FlutterTest;
	private observatoryUri: string;
	private suites: Suite[] = [];
	private groups: Group[] = [];
	private tests: Test[] = [];

	constructor() {
		super();

		this.sendStdOutToConsole = false;
	}

	protected spawnProcess(args: FlutterLaunchRequestArguments): any {
		const debug = !args.noDebug;
		let appArgs = [];

		if (args.previewDart2) {
			appArgs.push("--preview-dart-2");
		} else if (args.previewDart2 === false) {
			appArgs.push(`--no-preview-dart-2`);
		}

		// TODO: xxx
		// if (debug) {
		// 	appArgs.push("--start-paused");
		// }

		if (args.args) {
			appArgs = appArgs.concat(args.args);
		}

		this.flutter = new FlutterTest(this.args.flutterPath, args.cwd, appArgs, this.args.flutterRunLogFile);
		this.flutter.registerForUnhandledMessages((msg) => this.log(msg));

		// Set up subscriptions.
		// this.flutter.registerForStart((n) => this.log(JSON.stringify(n)));
		// this.flutter.registerForAllSuites((n) => this.log(JSON.stringify(n)));
		this.flutter.registerForSuite((n) => this.suites[n.suite.id] = n.suite);
		this.flutter.registerForTestStart((n) => this.tests[n.test.id] = n.test);
		this.flutter.registerForTestDone((n) => this.writeTestResult(n));
		this.flutter.registerForGroup((n) => this.groups[n.group.id] = n.group);
		this.flutter.registerForDone((n) => this.writeResult(n));

		return this.flutter.process;
	}

	private writeTestResult(testDone: TestDoneNotification) {
		const test = this.tests[testDone.testID];
		const symbol = testDone.result === "success" ? tick : cross;
		this.sendEvent(new OutputEvent(`${symbol} ${test.name}\n`, "stdout"));
	}

	private writeResult(testDone: DoneNotification) {
		if (testDone.success)
			this.sendEvent(new OutputEvent(`All tests passed!\n`, "stdout"));
		else
			this.sendEvent(new OutputEvent(`Some tests failed.\n`, "stderr"));
	}
}
