//
//  ViewController.m
//  MeasureDemoObjc
//
//  Created by Adwin Ross on 13/08/24.
//

#import "ViewController.h"

@interface ViewController  () <UITableViewDelegate, UITableViewDataSource>

@property (nonatomic, strong) NSArray *crashTypes;

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    
    // Initialize the crash types array
    self.crashTypes = @[
        @"Abort",
        @"Bad Pointer",
        @"Corrupt Memory",
        @"Corrupt Object",
        @"Deadlock",
        @"NSException",
        @"Stack Overflow",
        @"Zombie",
        @"Zombie NSException"
    ];
    
    // Create the table view
    UITableView *tableView = [[UITableView alloc] initWithFrame:self.view.bounds style:UITableViewStylePlain];
    tableView.delegate = self;
    tableView.dataSource = self;
    
    // Register a simple UITableViewCell class for use in creating cells
    [tableView registerClass:[UITableViewCell class] forCellReuseIdentifier:@"cell"];
    
    // Add the table view to the view controller's view
    [self.view addSubview:tableView];
}

#pragma mark - UITableViewDataSource

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
    return self.crashTypes.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"cell" forIndexPath:indexPath];
    cell.textLabel.text = self.crashTypes[indexPath.row];
    return cell;
}

#pragma mark - UITableViewDelegate

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
    NSString *selectedCrashType = self.crashTypes[indexPath.row];
    [self triggerCrash:selectedCrashType];
}

#pragma mark - Crash Triggers

- (void)triggerCrash:(NSString *)type {
    if ([type isEqualToString:@"Abort"]) {
        abort();
    } else if ([type isEqualToString:@"Bad Pointer"]) {
        int *pointer = (int *)0xdeadbeef;
        *pointer = 0;
    } else if ([type isEqualToString:@"Corrupt Memory"]) {
        int array[3] = {1, 2, 3};
        int corruptValue = array[4]; // Accessing out of bounds memory
        NSLog(@"%d", corruptValue);
    } else if ([type isEqualToString:@"Corrupt Object"]) {
        id object = [NSArray new];
        [object performSelector:NSSelectorFromString(@"invalidSelector")];
    } else if ([type isEqualToString:@"Deadlock"]) {
        dispatch_queue_t queue = dispatch_queue_create("deadlockQueue", NULL);
        dispatch_sync(queue, ^{
            dispatch_sync(queue, ^{
                // This will cause a deadlock
            });
        });
    } else if ([type isEqualToString:@"NSException"]) {
        NSArray *array = @[];
        NSLog(@"%@", array[1]); // This will throw an exception
    } else if ([type isEqualToString:@"Stack Overflow"]) {
        [self causeStackOverflow];
    } else if ([type isEqualToString:@"Zombie"]) {
        __weak id object = [NSObject new];
        NSLog(@"%@", [object description]); // Accessing a zombie object
    } else if ([type isEqualToString:@"Zombie NSException"]) {
        __weak NSException *exception = [NSException exceptionWithName:@"TestException" reason:@"Testing" userInfo:nil];
        exception = nil;
        [exception raise]; // This will crash due to a zombie exception
    }
}

- (void)causeStackOverflow {
    [self causeStackOverflow]; // Recursive call to cause a stack overflow
}

@end
