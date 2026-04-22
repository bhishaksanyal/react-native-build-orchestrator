import Table from "cli-table";
import pc from "picocolors";

export function banner(title: string): void {
  console.log(pc.bold(pc.cyan(title)));
}

export function info(message: string): void {
  console.log(pc.gray(message));
}

export function success(message: string): void {
  console.log(pc.green(message));
}

export function warn(message: string): void {
  console.log(pc.yellow(message));
}

export function fail(message: string): void {
  console.error(pc.red(message));
}

export function createTable(headers: string[]): Table {
  return new Table({
    head: headers.map((header) => pc.cyan(header)),
    style: {
      compact: false,
      "padding-left": 1,
      "padding-right": 1,
      head: [],
      border: []
    }
  });
}
