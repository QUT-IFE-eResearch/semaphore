Semaphore
=========

Semaphore is a collection of tools to assist in (semi-)automating the process of modelling and analysing ecosystem dynamics using Australian data. The process involves data transformations, model execution and calibration, and result verification.
More information can be found in our blog http://semaphoreblog.wordpress.com

All files and codes contained in this repository are all initial results of an ongoing project. They are considered as an pre-alpha release.
Different components are organised to main sub directories under this repository:

##1. execution-service
The modelling of Carbon and Nitrogen dynamics in the ecosystem involves running a simulation program such as Century (www.nrel.colostate.edu/projects/century). Normally, a researcher needs to download or request such program, install, and run it on their computer.
This directory contains a web application that provide a HTTP RESTful interface to run a model simulation on the cloud without the need to download and install the program locally. This tool is basically a web service wrapper for the modelling software.

##2. kepler
Using the scientific workflow software such as Kepler (https://kepler-project.org), researchers can construct a custom workflow using a visual drag-and-drop-style interface. The constructed workflow can then be used to semi-automate the process of model execution, calibration, and validation.
This directory contains some basic custom (Python) actors and examples of the workflow that represent a modelling process.

##3. excel-addins
The widespread use of Microsoft Excel as the easiest and most convenience tool to process simulation output data and compare them with the historical data should not be overlooked. 
In particular with the Century/Daycent model, the process of getting the output from the model to the excel spreadsheet is tedious and time-consuming.
This tool provides an add-ins that can be accessed form the ribbon interface (toolbar) to automatically import all the Century/Daycent output files to a currently open Excel workbook.


## Acknowledgment
This project is supported by the Australian National Data Service (ANDS) through the National Collaborative Research Infrastructure Strategy Program and the Education Investment Fund (EIF) Super Science Initiative.


## License 

(The GNU  Lesser General Public License)

Copyright (c) 2012-2013 Queensland University of Technology

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
