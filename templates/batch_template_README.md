# Batch Upload Template

The backend accepts an .xlsx file with exactly these six columns in order.
Row 1 must be the header row. The header labels are not case-sensitive.

| Column         | Accepted values                                                                     |
| -------------- | ----------------------------------------------------------------------------------- |
| MatricNumber   | Any text, 5 to 30 characters, must be unique per institution                        |
| StudentName    | Any text, 2 to 200 characters                                                       |
| CGPA           | Decimal number from 0.00 to 5.00 (e.g. 4.20)                                        |
| Classification | Text only: "Second Class Upper", "Second Class Lower", "Third Class", "First Class" |
| CourseName     | Any text, 2 to 200 characters                                                       |
| GraduationYear | Four-digit integer, 1960 to 2030                                                    |

Rows that fail validation are listed in the batch error report.
Valid rows are processed even when some rows fail.
