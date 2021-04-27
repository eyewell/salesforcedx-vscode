/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkdir, rm } from 'shelljs';
import { SOQLMETADATA_DIR, TOOLS_DIR } from '../constants';
import { SObjectShortDescription } from '../describe';
import { nls } from '../messages';
import { SObject, SObjectGenerator, SObjectRefreshOutput } from '../types';

const REL_BASE_FOLDER = [TOOLS_DIR, SOQLMETADATA_DIR];

export class SOQLMetadataGenerator implements SObjectGenerator {
  public constructor() {}

  public generate(output: SObjectRefreshOutput): void {
    const outputFolderPath = path.join(output.sfdxPath, ...REL_BASE_FOLDER);
    if (!this.resetOutputFolder(outputFolderPath)) {
      throw nls.localize('no_sobject_output_folder_text', outputFolderPath);
    }

    const sobjects = [...output.getStandard(), ...output.getCustom()];

    for (const sobj of sobjects) {
      if (sobj.name) {
        this.generateMetadataForSObject(outputFolderPath, sobj);
      }
    }
  }

  private generateMetadataForSObject(
    folderPath: string,
    sobject: SObject
  ): void {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const targetPath = path.join(folderPath, `${sobject.name}.json`);
    fs.writeFileSync(targetPath, JSON.stringify(sobject, null, 2), {
      mode: 0o444
    });
  }

  private resetOutputFolder(pathToClean: string): boolean {
    if (fs.existsSync(pathToClean)) {
      rm('-rf', pathToClean);
    }
    if (!fs.existsSync(pathToClean)) {
      mkdir('-p', pathToClean);
      return fs.existsSync(pathToClean);
    }
    return true;
  }
}
