"""Independent expected balances: Decimal only, no application code or personal data."""
from decimal import Decimal as D, ROUND_HALF_UP
import json
from pathlib import Path
bank=D('1000');wallet=D('0');card=D('0');shares=D('0');price=D('0');expense=D('0');income=D('0');book=D('0');realized=D('0');snapshots=[]
def snap(name):
 cash=bank+wallet;portfolio=(shares*price).quantize(D('.01'),rounding=ROUND_HALF_UP)
 snapshots.append(dict(name=name,bank=str(bank),wallet=str(wallet),card=str(card),cash=str(cash),shares=str(shares),portfolio=str(portfolio),expense=str(expense),income=str(income),book=str(book),realized=str(realized),netWorth=str(cash+portfolio+card)))
snap('opening')
bank+=D('500');income+=D('500');snap('income')
bank-=D('100');wallet+=D('100');snap('walletFunding')
wallet-=D('30');expense+=D('30');snap('walletPurchase')
wallet+=D('5');expense-=D('5');snap('walletRefund')
card-=D('40');expense+=D('40');snap('cardPurchase')
bank-=D('40');card+=D('40');snap('cardSettlement')
bank-=D('201');shares=D('2');price=D('100');book=D('201');expense+=D('1');snap('purchase')
price=D('110');snap('revaluation')
bank+=D('119');shares-=D('1');book-=D('100.50');realized+=D('18.50');expense+=D('1');snap('partialSale')
bank+=D('89');shares-=D('1');realized-=D('11.50');book=D('0');expense+=D('1');snap('finalSale')
# A card credit is an asset, not disposable bank cash.
card=D('15');bank-=D('15');snap('cardCredit')
rounding=[{'input':v,'expected':str(D(v).quantize(D('.01'),rounding=ROUND_HALF_UP) or D('0.00'))} for v in ['-1.005','10.075','1.255','-0.00000000001','999999.995']]
result={'method':'Python Decimal, independently posted fixed scenario; ROUND_HALF_UP','snapshots':snapshots,'rounding':rounding}


# Second independent reference: 160 deterministic cash/credit-card events.
import random
rng=random.Random(73119)
balances={'Banca':D('10000'),'Wallet':D('0'),'Carta':D('0')}
income=D('0'); expense=D('0'); random_cases=[]
for i in range(160):
    kind=rng.choice(['income','purchase','transfer'])
    amount=D(rng.randrange(1,50001))/D(100)
    event={'id':'random-'+str(i),'kind':kind,'amount':str(amount)}
    if kind=='income':
        event['account']='Banca';balances['Banca']+=amount;income+=amount
    elif kind=='purchase':
        account=rng.choice(list(balances));event['account']=account;balances[account]-=amount;expense+=amount
    else:
        source,target=rng.sample(list(balances),2);fee=D(rng.choice([0,1,25,100]))/D(100);event.update(source=source,target=target,fee=str(fee));balances[source]-=amount+fee;balances[target]+=amount;expense+=fee
    event['expected']={k:str(v) for k,v in balances.items()}
    event['expected'].update(income=str(income),expense=str(expense),netWorth=str(sum(balances.values())))
    random_cases.append(event)
result['randomSeed']=73119;result['randomCases']=random_cases
import sys
target=Path(__file__).resolve().parents[2].joinpath('tests/fixtures/accounting-oracle.json')
encoded=json.dumps(result,indent=2)+'\n'
if '--check' in sys.argv:
    if target.read_text()!=encoded: raise SystemExit('Independent oracle fixture differs; inspect the change before accepting it')
    print('Independent Python Decimal oracle matches committed fixture')
else:
    target.write_text(encoded)
