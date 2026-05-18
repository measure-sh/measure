//
//  ObjcDetailViewController.m
//  DemoApp
//
//  Created by Adwin Ross on 07/10/24.
//

#import "ObjcDetailViewController.h"
#import "DemoApp-Swift.h"

@interface ObjcDetailViewController () <UITableViewDelegate, UITableViewDataSource>

@property (nonatomic, strong) NSArray *crashTypes;
@property (nonatomic, strong) NSArray *httpEventTypes;

@end

@implementation ObjcDetailViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    
    self.crashTypes = @[
        @"Abort",
        @"Bad Pointer",
        @"Corrupt Memory",
        @"Corrupt Object",
        @"Deadlock",
        @"NSException",
        @"Stack Overflow",
        @"Zombie",
        @"Zombie NSException",
        @"Background thread crash",
        @"Segmentation Fault (SIGSEGV)",
        @"Abnormal Termination (SIGABRT)",
        @"Illegal Instruction (SIGILL)",
        @"Bus Error (SIGBUS)"
    ];

    self.httpEventTypes = @[@"Track HTTP Event"];
    
    UITableView *tableView = [[UITableView alloc] initWithFrame:self.view.bounds style:UITableViewStylePlain];
    tableView.delegate = self;
    tableView.dataSource = self;
    [tableView registerClass:[UITableViewCell class] forCellReuseIdentifier:@"cell"];
    
    UIView *headerView = [self createTableHeaderView];
    tableView.tableHeaderView = headerView;

    NSDictionary *userAttributes = @{
        @"user_name": @"Alice",
        @"paid_user": @YES,
        @"credit_balance": @1000,
        @"latitude": @30.2661403415387};
    [Measure start];
    [Measure trackEvent:@"event-name" attributes:userAttributes timestamp:nil];
    
    [self setTitle:@"Objc View Controller"];
    
    [self.view addSubview:tableView];
    [Measure trackScreenView:@"ObjcViewController" attributes:userAttributes];
}

// MARK: - Create Table Header with Buttons

- (UIView *)createTableHeaderView {
    // Create the header view
    UIView *headerView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, self.view.bounds.size.width, 150)];

    NSArray *buttonTitles = @[@"SwiftUI Controller", @"Collection Controller", @"Track Spans"];
    
    // Create two vertical stack views
    UIStackView *verticalStackView1 = [[UIStackView alloc] init];
    verticalStackView1.axis = UILayoutConstraintAxisVertical;
    verticalStackView1.distribution = UIStackViewDistributionFillEqually;
    verticalStackView1.spacing = 8;

    UIStackView *verticalStackView2 = [[UIStackView alloc] init];
    verticalStackView2.axis = UILayoutConstraintAxisVertical;
    verticalStackView2.distribution = UIStackViewDistributionFillEqually;
    verticalStackView2.spacing = 8;

    // Add buttons to vertical stack views
    for (int i = 0; i < [buttonTitles count]; i++) {
        UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
        [button setTitle:buttonTitles[i] forState:UIControlStateNormal];
        button.layer.cornerRadius = 8;
        button.layer.borderWidth = 1;
        button.layer.borderColor = [UIColor systemBlueColor].CGColor;
        button.tag = i;
        [button addTarget:self action:@selector(headerButtonTapped:) forControlEvents:UIControlEventTouchUpInside];
        
        if (i % 2 == 0) {
            [verticalStackView1 addArrangedSubview:button];
        } else {
            [verticalStackView2 addArrangedSubview:button];
        }
    }

    // Create horizontal stack view
    UIStackView *horizontalStackView = [[UIStackView alloc] initWithArrangedSubviews:@[verticalStackView1, verticalStackView2]];
    horizontalStackView.axis = UILayoutConstraintAxisHorizontal;
    horizontalStackView.distribution = UIStackViewDistributionFillEqually;
    horizontalStackView.spacing = 16;

    // Add horizontal stack view to the header view
    horizontalStackView.translatesAutoresizingMaskIntoConstraints = NO;
    [headerView addSubview:horizontalStackView];

    // Set constraints for the horizontal stack view
    [NSLayoutConstraint activateConstraints:@[
        [horizontalStackView.leadingAnchor constraintEqualToAnchor:headerView.leadingAnchor constant:20],
        [horizontalStackView.trailingAnchor constraintEqualToAnchor:headerView.trailingAnchor constant:-20],
        [horizontalStackView.topAnchor constraintEqualToAnchor:headerView.topAnchor constant:8],
        [horizontalStackView.bottomAnchor constraintEqualToAnchor:headerView.bottomAnchor constant:-8]
    ]];

    return headerView;
}


- (void)headerButtonTapped:(UIButton *)sender {
    switch (sender.tag) {
        case 0:
            [self navigateToSwiftUIView];
            break;
        case 1:
            [self transitionToCollectionViewController];
            break;
        case 2:
            [self trackSpans];
            break;
        default:
            break;
    }
}

- (void)trackSpans {
    MsrObjCSpan *parentSpan = [Measure startSpanWithName:@"parent_span"];

    MsrObjCSpanBuilder *childBuilder1 = [Measure createSpanBuilderWithName:@"child_span_1"];
    [childBuilder1 setParent:parentSpan];
    MsrObjCSpan *childSpan1 = [childBuilder1 startSpan];

    MsrObjCSpanBuilder *childBuilder2 = [Measure createSpanBuilderWithName:@"child_span_2"];
    [childBuilder2 setParent:parentSpan];
    MsrObjCSpan *childSpan2 = [childBuilder2 startSpan];

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [childSpan1 setStatus:MsrSpanStatusOk];
        [childSpan1 end];
        [childSpan2 setStatus:MsrSpanStatusOk];
        [childSpan2 end];
    });

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [parentSpan setStatus:MsrSpanStatusOk];
        [parentSpan end];
    });
}

-(void)transitionToCollectionViewController {
    CollectionViewController *controller = [[CollectionViewController alloc] init];
    [[self navigationController] pushViewController:controller animated:YES];
}

- (void)navigateToSwiftUIView {
    SwiftUIWrapper *swiftUIWrapper = [[SwiftUIWrapper alloc] init];
    UIViewController *swiftUIViewController = [swiftUIWrapper createSwiftUIViewController];
    [self.navigationController pushViewController:swiftUIViewController animated:YES];
}

// MARK: - UITableViewDataSource

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView {
    return 2;
}

- (NSString *)tableView:(UITableView *)tableView titleForHeaderInSection:(NSInteger)section {
    return section == 0 ? @"Crash Types" : @"HTTP Events";
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
    return section == 0 ? self.crashTypes.count : self.httpEventTypes.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"cell" forIndexPath:indexPath];
    NSArray *source = indexPath.section == 0 ? self.crashTypes : self.httpEventTypes;
    cell.textLabel.text = source[indexPath.row];
    cell.textLabel.textColor = indexPath.section == 0 ? [UIColor systemRedColor] : [UIColor systemBlueColor];
    return cell;
}

// MARK: - UITableViewDelegate

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
    [tableView deselectRowAtIndexPath:indexPath animated:YES];
    if (indexPath.section == 0) {
        [self triggerCrashWithType:self.crashTypes[indexPath.row]];
    } else {
        [self triggerHttpEventWithType:self.httpEventTypes[indexPath.row]];
    }
}

// MARK: - HTTP Tracking

- (void)triggerHttpEventWithType:(NSString *)type {
    if ([type isEqualToString:@"Track HTTP Event"]) {
        UInt64 startTime = (UInt64)(CFAbsoluteTimeGetCurrent() * 1000);
        UInt64 endTime = startTime + 150;
        [Measure trackHttpEventObjcWithUrl:@"https://api.example.com/users"
                                    method:@"get"
                                 startTime:startTime
                                   endTime:endTime
                                    client:@"URLSession"
                                statusCode:@200
                                     error:nil
                            requestHeaders:nil
                           responseHeaders:@{@"Content-Type": @"application/json"}
                               requestBody:nil
                              responseBody:@"{\"id\":1,\"name\":\"Alice\"}"];
    }
}

// MARK: - Crash Triggers

- (void)triggerCrashWithType:(NSString *)type {
    if ([type isEqualToString:@"Abort"]) {
        abort();
    } else if ([type isEqualToString:@"Bad Pointer"]) {
        int *pointer = (int *)0xdeadbeef;
        *pointer = 0;
    } else if ([type isEqualToString:@"Corrupt Memory"]) {
        int array[] = {1, 2, 3};
        int value = *(array + 4);
        NSLog(@"%d", value);
    } else if ([type isEqualToString:@"Corrupt Object"]) {
        id object = [NSArray array];
        [object performSelector:NSSelectorFromString(@"invalidSelector")];
    } else if ([type isEqualToString:@"Deadlock"]) {
        dispatch_queue_t queue = dispatch_queue_create("deadlockQueue", NULL);
        dispatch_sync(queue, ^{
            dispatch_sync(queue, ^{ });
        });
    } else if ([type isEqualToString:@"NSException"]) {
        NSArray *array = [NSArray array];
        NSLog(@"%@", array[1]);
    } else if ([type isEqualToString:@"Stack Overflow"]) {
        [self recurse];
    } else if ([type isEqualToString:@"Zombie"]) {
        NSObject *object = [[NSObject alloc] init];
        __weak NSObject *weakObject = object;
        object = nil;
        NSLog(@"%@", weakObject.description);
    } else if ([type isEqualToString:@"Zombie NSException"]) {
        NSException *exception = [NSException exceptionWithName:NSGenericException reason:@"Test" userInfo:nil];
        __weak NSException *weakException = exception;
        exception = nil;
        [weakException raise];
    } else if ([type isEqualToString:@"Background thread crash"]) {
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), ^{
            NSArray *array = [NSArray array];
            NSLog(@"%@", array[1]);
        });
    } else if ([type isEqualToString:@"Segmentation Fault (SIGSEGV)"]) {
        int *pointer = (int *)malloc(sizeof(int));
        free(pointer);
        *pointer = 0;
    } else if ([type isEqualToString:@"Abnormal Termination (SIGABRT)"]) {
        NSArray *array = @[];
        NSLog(@"%@", array[1]);
    } else if ([type isEqualToString:@"Illegal Instruction (SIGILL)"]) {
        void (*invalidInstruction)(void) = (void (*)(void))0;
        invalidInstruction();
    } else if ([type isEqualToString:@"Bus Error (SIGBUS)"]) {
        int *invalidAddress = (int *)0x1;
        *invalidAddress = 0;
    } else {
        NSLog(@"Unknown crash type.");
    }
}

- (void)recurse {
    [self recurse];
}

@end
