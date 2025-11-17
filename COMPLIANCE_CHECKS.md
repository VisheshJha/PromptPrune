# Compliance Checks List

## Pattern-Based Detection (25 types)

1. email
2. phone
3. ssn
4. creditCard
5. bankAccount
6. passport
7. driverLicense
8. ipAddress
9. apiKey
10. password
11. jwt
12. awsKey
13. privateKey
14. databaseUrl
15. cryptoKey
16. medicalRecord
17. taxId
18. aadhaar
19. pan
20. voterId
21. ifsc
22. upiId
23. gstin
24. indianBankAccount
25. indianPhone

## Keyword-Based Detection (52 keywords)

1. confidential
2. internal use only
3. proprietary
4. classified
5. secret
6. nda
7. non-disclosure
8. trade secret
9. customer data
10. personal information
11. pii
12. phi
13. source code
14. sourcecode
15. algorithm
16. business plan
17. financial statement
18. revenue
19. salary
20. employee id
21. social security
22. aadhaar
23. pan card
24. voter id
25. ifsc
26. upi
27. gstin
28. gst number
29. icici bank
30. sbi
31. hdfc
32. axis bank
33. reliance retail
34. ondc
35. npci
36. rbi
37. smart city
38. jiomart
39. flipkart
40. delhivery
41. maharashtra
42. q3 revenue
43. quarterly revenue
44. supplier churn
45. proprietary algorithm
46. proprietary logistics
47. board memo
48. internal memo
49. project horizon
50. ayushman bharat
51. hospital discharge

## Risk Scoring

- High severity: +30 points (patterns) / +25 points (keywords)
- Medium severity: +15 points
- Low severity: +5 points
- Block threshold: Risk score ≥ 50

