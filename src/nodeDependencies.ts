import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as stripJsonComments from 'strip-json-comments';
interface BitMapJson {
	[componentName: string]: BitComponent | string
}
interface BitComponent {
	files: BitFile[],
	mainFile: string;
	trackDir: string;
	origin: string;
	exported: boolean;
}
interface BitComponentExtended extends BitComponent {
	organisation: string;
	collection: string;
	namespace: string;
	name: string;
	version: string;
}
interface BitFile {
	relativePath: string;
	test: boolean;
	name: string
}
export class DepNodeProvider implements vscode.TreeDataProvider<Component> {
	private bitcomponents: BitComponentExtended[]
	private _onDidChangeTreeData: vscode.EventEmitter<Component | undefined> = new vscode.EventEmitter<Component | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Component | undefined> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string) {
		if (!workspaceRoot) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
		} else {
			const bitmapJSONPath = path.join(this.workspaceRoot, '.bitmap');
			
			if (this.pathExists(bitmapJSONPath)) {
				this.bitcomponents = this.getComponents(bitmapJSONPath)
			} else {
				vscode.window.showInformationMessage('Workspace has no .bitmap');
				vscode.window.showInformationMessage('Please run bit init');
			}
		}

	}
	getComponents(bitmapPath): BitComponentExtended[]{
		if (this.pathExists(bitmapPath)) {
			const bitmapFile = fs.readFileSync(bitmapPath, 'utf-8')
			const bitmapJSON: BitMapJson = JSON.parse(stripJsonComments(bitmapFile));

			const components = bitmapJSON
				? Object.keys(bitmapJSON).reduce((acc, key) => {
					const bitComponent = bitmapJSON[key]
					if(typeof bitComponent !== 'string'){
						const data = getComponentData(key)
						acc.push(
							{...bitComponent, ...data}
						)
					}
					return acc
				}, [] as BitComponentExtended[])
				: [];
			return components;
		} else {
			return [];
		}
	}
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Component): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Component): Thenable<Component[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No dependency in empty workspace');
			return Promise.resolve([]);
		}
		let children: Component[] = []
		if (element) {
			switch (element.type) {
				case 'organisation':
					const collections = groupBy(element.children, "collection")
					children = Object.keys(collections).map(key => (new Component(key, 'collection', collections[key], vscode.TreeItemCollapsibleState.Expanded)))
					break;
				case 'collection':
					const namespaces = groupBy(element.children, "namespace")
					children = Object.keys(namespaces).map(key => (new Component(key, 'namespace', namespaces[key], vscode.TreeItemCollapsibleState.Expanded)))
					break;
				case 'namespace':
					const names = groupBy(element.children, "name")
					children = Object.keys(names).map(key => (new Component(key, 'name', names[key], vscode.TreeItemCollapsibleState.None)))
					break;
				default:
					break;
			}
			return Promise.resolve(children);
		} else {
			if (this.bitcomponents) {
				let orgs = groupBy(this.bitcomponents, "organisation")
				const components = Object.keys(orgs).map(key => (new Component(key, 'organisation', orgs[key], vscode.TreeItemCollapsibleState.Expanded)))
				return Promise.resolve(components);
			} else {
				vscode.window.showInformationMessage('Workspace has no .bitmap');
				vscode.window.showInformationMessage('Please run bit init');
				return Promise.resolve([]);
			}
		}

	}



	

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}
}

function getComponentData(key: string){
		// atto-byte.slate/plugin/image@0.0.2
	const organisation = key.split('.')[0]
	const collection = key.split('.')[1].split('/')[0]
	const namespace = key.split('.')[1].split('/')[1]
	const name = key.split('.')[1].split('/')[2].split('@')[0]
	const version = key.split('@')[1]
	return {organisation, collection, namespace, name, version}
}

export class Component extends vscode.TreeItem {

	constructor(
		public readonly name: string,
		public readonly type: 'organisation'| 'collection' | 'namespace' | 'name',
		public readonly children: BitComponentExtended[],
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(name, collapsibleState);
	}

	get tooltip(): string {
		return `${this.type}`;
	}

	get description(): string {
		return ``;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', `${this.type}.svg`),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', `${this.type}.svg`)
	};

	contextValue = 'dependency';

}
function groupBy<T, K extends keyof T>(objects:T[], field: any){
	return objects.reduce((acc, object) => {
		acc[object[field]] = acc[object[field]]  || [];
		acc[object[field]].push(object)
		return acc
	}, {} as {[field: string]: T[]})
}